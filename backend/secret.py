"""API Key 的本地加密存储。

Windows 下用 DPAPI（CryptProtectData，绑定当前 Windows 用户，其他账户拷走文件也解不开）；
其他平台退化为 machine-id 派生的 HMAC 流加密，仅用于避免明文落盘。

密文格式：enc:v1:<base64>
"""

from __future__ import annotations

import base64
import hashlib
import os
import sys

_PREFIX = "enc:v1:"


# ---------------- Windows DPAPI ----------------

def _dpapi(data: bytes, protect: bool) -> bytes | None:
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes

    class _Blob(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    buf = ctypes.create_string_buffer(data, len(data))
    src = _Blob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    dst = _Blob()
    fn = ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    # CRYPTPROTECT_UI_FORBIDDEN：禁止弹窗，服务进程里静默失败
    if protect:
        ok = fn(ctypes.byref(src), None, None, None, None, 0x1, ctypes.byref(dst))
    else:
        ok = fn(ctypes.byref(src), None, None, None, None, 0x1, ctypes.byref(dst))
    if not ok:
        return None
    try:
        return ctypes.string_at(dst.pbData, dst.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(dst.pbData)


# ---------------- 非 Windows 回退 ----------------

def _machine_key() -> bytes:
    seed = ""
    for path in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        try:
            seed = open(path, encoding="utf-8").read().strip()
            if seed:
                break
        except OSError:
            continue
    if not seed:
        seed = os.environ.get("USER", "") + os.environ.get("HOSTNAME", os.uname().nodename)
    return hashlib.sha256(("lithub:" + seed).encode()).digest()


def _xor_stream(data: bytes, nonce: bytes, key: bytes) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < len(data):
        out += hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        counter += 1
    return bytes(a ^ b for a, b in zip(data, out))


def _fallback(data: bytes, protect: bool) -> bytes | None:
    key = _machine_key()
    if protect:
        nonce = os.urandom(16)
        return nonce + _xor_stream(data, nonce, key)
    nonce, body = data[:16], data[16:]
    return _xor_stream(body, nonce, key)


# ---------------- 对外接口 ----------------

def encrypt(plain: str) -> str:
    """明文 → `enc:v1:...`；加密不可用时退回明文（调用方仍能正常工作）。"""
    if not plain:
        return ""
    raw = plain.encode("utf-8")
    blob = _dpapi(raw, True)
    if blob is None:
        blob = _fallback(raw, True)
    if blob is None:
        return plain
    return _PREFIX + base64.b64encode(blob).decode("ascii")


def decrypt(value: str) -> str:
    """`enc:v1:...` → 明文；非密文（历史明文）原样返回。"""
    if not value or not isinstance(value, str) or not value.startswith(_PREFIX):
        return value or ""
    try:
        blob = base64.b64decode(value[len(_PREFIX):])
    except Exception:
        return ""
    raw = _dpapi(blob, False)
    if raw is None:
        raw = _fallback(blob, False)
    try:
        return raw.decode("utf-8") if raw else ""
    except Exception:
        return ""


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_PREFIX)
