"""User-managed OpenAI-compatible API profiles. Keys stay in the encrypted key map."""
import copy
import math
import re
from urllib.parse import urlsplit

import secret

# Used only to recover already configured older libraries, never to seed a new library.
LEGACY = {
    "openai": ("OpenAI 兼容", "https://api.openai.com/v1", "gpt-4o-mini"),
    "deepseek": ("DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat"),
    "zhipu": ("智谱 AI", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"),
}


def normalize_profiles(profiles):
    if not isinstance(profiles, list) or len(profiles) > 100:
        raise ValueError("API 列表格式无效，最多添加 100 个 API")
    result, seen = [], set()
    for p in profiles:
        pid = p.get("id", "")
        name = p.get("name", "").strip()
        base = p.get("base_url", "").strip().rstrip("/")
        model = p.get("model", "").strip()
        temperature = p.get("temperature", 0.3)
        if not isinstance(pid, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", pid) or pid in seen:
            raise ValueError("API 标识无效或重复")
        if not name or len(name) > 80:
            raise ValueError("请填写 API 名称（最多 80 个字符）")
        if len(base) > 2048 or (base and (urlsplit(base).scheme not in {"http", "https"} or not urlsplit(base).hostname)):
            raise ValueError("Base URL 需要是有效的 http/https 地址")
        if len(model) > 256:
            raise ValueError("模型名称过长")
        if not isinstance(temperature, (int, float)) or not math.isfinite(temperature) or not 0 <= temperature <= 1:
            raise ValueError("温度需要在 0 到 1 之间")
        seen.add(pid)
        result.append(dict(id=pid, name=name, base_url=base, model=model, temperature=temperature))
    return result


def sync_active(cfg):
    profiles = cfg.get("api_profiles", [])
    selected = next((p for p in profiles if p["id"] == cfg.get("provider")), None)
    if selected is None:
        selected = next(iter(profiles), None)
    cfg["provider"] = selected["id"] if selected else ""
    cfg["base_url"] = selected["base_url"] if selected else ""
    cfg["model"] = selected["model"] if selected else ""
    cfg["temperature"] = selected.get("temperature", 0.3) if selected else 0.3
    cfg["api_key"] = cfg.get("api_keys", {}).get(cfg["provider"], "")


def migrate_profiles(cfg):
    """Keep existing credentials while replacing the old fixed provider catalogue once."""
    if "api_profiles" in cfg:
        return False
    current = cfg.get("provider") or ""
    keys = dict(cfg.get("api_keys") or {})
    if cfg.get("api_key"):
        current = current or "legacy-api"
        keys.setdefault(current, cfg["api_key"])
    ids = [pid for pid, key in keys.items() if key]
    if current and (cfg.get("base_url") or cfg.get("model")) and current not in ids:
        ids.append(current)
    profiles = []
    for pid in ids:
        name, base, model = LEGACY.get(pid, ("已有 API", "", ""))
        profiles.append(dict(id=pid, name=name,
            base_url=(cfg.get("base_url") or base) if pid == current else base,
            model=(cfg.get("model") or model) if pid == current else model,
            temperature=cfg.get("temperature", 0.3)))
    cfg["api_profiles"] = profiles
    cfg["api_keys"] = {pid: value if secret.is_encrypted(value) else secret.encrypt(value) for pid, value in keys.items() if pid in ids}
    cfg["provider"] = current
    sync_active(cfg)
    return True


def update_profiles(settings, fields):
    cfg = copy.deepcopy(settings)
    profiles = fields.get("api_profiles", cfg.get("api_profiles", []))
    # Older API clients can still explicitly save a provider; fresh defaults remain empty.
    pid = fields.get("provider", cfg.get("provider", ""))
    if "api_profiles" not in fields and pid and not any(p["id"] == pid for p in profiles):
        if not any(fields.get(k) for k in ("base_url", "model", "api_key")):
            raise ValueError("请先添加 API")
        profiles.append(dict(id=pid, name=LEGACY.get(pid, ("已有 API",))[0], base_url="", model="", temperature=0.3))
    profiles = copy.deepcopy(profiles)
    selected = next((p for p in profiles if p["id"] == pid), None)
    if pid and selected is None:
        if "provider" in fields:
            raise ValueError("选中的 API 不存在")
        pid = ""
    if selected:
        for key in ("base_url", "model", "temperature"):
            if key in fields:
                selected[key] = fields[key]
    profiles = normalize_profiles(profiles)
    ids = {p["id"] for p in profiles}
    keys = {k: v for k, v in (cfg.get("api_keys") or {}).items() if k in ids}
    changes = dict(fields.get("api_keys") or {})
    if "api_key" in fields:
        changes[pid] = fields["api_key"]
    for key_id, value in changes.items():
        if key_id not in ids:
            raise ValueError("API Key 对应的服务不存在")
        if not value:
            keys.pop(key_id, None)
        else:
            keys[key_id] = value if secret.is_encrypted(value) else secret.encrypt(value)
    cfg.update(api_profiles=profiles, api_keys=keys, provider=pid)
    sync_active(cfg)
    return cfg
