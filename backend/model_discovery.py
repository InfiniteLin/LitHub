"""Read model metadata without generating a chat completion or persisting draft credentials."""
from urllib.parse import urlsplit


def discover_models(base_url, api_key):
    import httpx
    import openai
    try:
        url = urlsplit(base_url)
        if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password or url.query or url.fragment:
            return dict(ok=False, models=[], message="请填写有效的 Base URL，也可手动填写模型。")
        # No redirects or automatic retries: an implicit probe must be bounded and must not
        # forward credentials to another host or silently repeat a failing request.
        with httpx.Client(timeout=8, follow_redirects=False) as transport:
            with openai.OpenAI(base_url=base_url, api_key=api_key, timeout=8, max_retries=0, http_client=transport) as client:
                data = client.models.list().data
        if not isinstance(data, list):
            raise ValueError("Invalid model list")
        models = sorted({m.id.strip() for m in data[:5000] if isinstance(getattr(m, "id", None), str) and 0 < len(m.id.strip()) <= 256}, key=str.casefold)[:1000]
        return dict(ok=True, models=models, message="" if models else "上游未返回模型列表，可手动填写模型。")
    except (openai.AuthenticationError, openai.PermissionDeniedError):
        message = "无法读取模型列表，请检查 API Key 和权限；也可手动填写模型。"
    except openai.APIStatusError as exc:
        message = "上游未提供模型列表，可手动填写模型。" if exc.status_code in {404, 405} else "暂时无法读取上游模型列表，可继续手动填写模型。"
    except Exception:
        message = "暂时无法获取模型列表，可继续手动填写模型。"
    return dict(ok=False, models=[], message=message)


def same_origin(a, b):
    try:
        def origin(value):
            u = urlsplit(value)
            return u.scheme, u.hostname, u.port or (443 if u.scheme == 'https' else 80)
        return origin(a) == origin(b)
    except ValueError:
        return False
