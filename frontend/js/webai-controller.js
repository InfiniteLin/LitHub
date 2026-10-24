/* One native session, independent of router/DOM. Adapters implement open/close/bounds. */
window.WebAiController = class WebAiController {
  constructor({ adapters, onClosed = () => {}, onError = () => {}, timeout = 45000, boundsTimeout = 4000 }) {
    this.adapters = adapters;
    this.onClosed = onClosed;
    this.onError = onError;
    this.timeout = timeout;
    this.boundsTimeout = boundsTimeout;
    this.state = "closed";
    this.owner = null;
    this.requestedOwner = null;
    this.url = "";
    this.error = null;
    this.mode = null;
    this._epoch = 0;
    this._queue = Promise.resolve();
    this._boundsBusy = false;
    this._desired = null;
    this._boundsVersion = 0;
    this._lastBounds = null;
    this._seq = 0;
    this._session = "";
  }

  whenIdle() { return this._queue; }
  _enqueue(run) {
    const task = this._queue.then(run, run);
    this._queue = task.catch(() => {});
    return task;
  }
  async _call(run, timeout = this.timeout) {
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(run),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("网页 AI 请求超时，请重试")), timeout); }),
      ]);
      if (result?.ok === false) throw Object.assign(new Error(result.error || "网页 AI 操作失败"), { result });
      return result || { ok: true };
    } finally { clearTimeout(timer); }
  }
  _closeNative(mode) { return this._call(() => this.adapters[mode].close(), 8000); }

  open({ owner, url, mode, options = {}, force = false }) {
    const epoch = ++this._epoch;
    this.requestedOwner = owner;
    return this._enqueue(async () => {
      if (epoch !== this._epoch) return { ok: false, cancelled: true };
      this.error = null;
      try {
        // A shared same-site session follows the active paper without navigating the conversation.
        if (!force && this.owner && this.url === url && this.mode === mode && this.state !== "failed") {
          this.owner = owner;
          this._lastBounds = null;
          return { ok: true, reused: true };
        }
        if (this.owner && this.mode) await this._closeNative(this.mode);
        if (epoch !== this._epoch) return { ok: false, cancelled: true };
        this.owner = null;
        this.mode = mode;
        this.state = "opening";
        this._lastBounds = null;
        const result = await this._call(() => this.adapters[mode].open(url, options));
        if (epoch !== this._epoch) {
          await this._closeNative(mode);
          return { ok: false, cancelled: true };
        }
        this.owner = owner;
        this.url = url;
        this._session = result.session_id || "";
        this.state = "hidden";
        return { ...result, ok: true };
      } catch (error) {
        try { await this._closeNative(mode); } catch (cleanupError) { error.message += `；${cleanupError.message}`; }
        if (epoch !== this._epoch) return { ok: false, cancelled: true };
        this.owner = null;
        this.state = "failed";
        this.error = error.message;
        return { ok: false, error: error.message };
      }
    });
  }

  close() {
    ++this._epoch;
    this.requestedOwner = null;
    this._desired = null;
    this._boundsVersion++;
    const mode = this.mode;
    // Cancels a pending native search immediately; do not wait behind that search.
    const interrupt = this.state === "opening" && mode ? this._closeNative(mode).catch(() => {}) : null;
    this.state = "closing";
    return this._enqueue(async () => {
      try {
        await interrupt;
        if (mode) await this._closeNative(mode);
        this.owner = null;
        this.url = "";
        this._session = "";
        this._lastBounds = null;
        this.state = "closed";
        this.error = null;
        return { ok: true };
      } catch (error) {
        this.state = "failed";
        this.error = error.message;
        this.onError(error.message);
        return { ok: false, error: error.message };
      }
    });
  }

  dispose(owner) {
    if (this.requestedOwner === owner || (this.owner === owner && !this.requestedOwner)) return this.close();
    return Promise.resolve({ ok: true });
  }

  sync(rect) {
    this._desired = { ...rect };
    this._boundsVersion++;
    return this._drainBounds();
  }
  async _drainBounds() {
    if (this._boundsBusy || !this.owner || !this.mode || ["opening", "closing", "closed"].includes(this.state)) return;
    this._boundsBusy = true;
    let attempted = -1;
    try {
      while (this._desired && this.owner && attempted !== this._boundsVersion) {
        attempted = this._boundsVersion;
        const rect = this._desired;
        const key = JSON.stringify(rect);
        if (key === this._lastBounds) break;
        const epoch = this._epoch, owner = this.owner;
        let error;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await this._call(() => this.adapters[this.mode].bounds({
              ...rect, seq: ++this._seq, session_id: this._session,
            }), this.boundsTimeout);
            if (epoch !== this._epoch) return;
            if (result.stale) throw new Error("浏览器会话已更换，请重新打开网页 AI");
            this._lastBounds = key;
            this.state = rect.visible ? "visible" : "hidden";
            error = null;
            break;
          } catch (err) {
            if (epoch !== this._epoch) return;
            if (err.result?.closed || err.result?.stale) {
              this.owner = null;
              this.state = "closed";
              this._lastBounds = null;
              this.onClosed(owner);
              return;
            }
            error = err;
            if (attempted !== this._boundsVersion) break; // New geometry supersedes a retry.
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
          }
        }
        if (error) {
          if (this.error !== error.message) this.onError(error.message);
          this.error = error.message;
        }
      }
    } finally {
      this._boundsBusy = false;
      if (this._desired && attempted !== this._boundsVersion) this._drainBounds();
    }
  }
};
