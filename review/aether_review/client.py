"""Thin async client for Max's local job API.

The review pages never touch the job database or the filesystem directly.
Everything goes through the endpoints listed in TECHNICAL_PLAN.md
("Local interface"). The response shapes this client expects are written
down in review/API_CONTRACT.md so Max can confirm or correct them.
"""

from __future__ import annotations

import re
from typing import Any, AsyncIterator

import httpx

# Job and artifact ids are opaque registered identifiers. Restricting them to
# a conservative character set keeps a crafted id from turning into a
# different API path (for example "../../jobs").
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")

REVIEW_DECISIONS = ("approve", "reject", "revise")


class ApiError(Exception):
    """The API answered with an error status."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(f"{status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail


class ApiUnavailable(Exception):
    """The API could not be reached at all."""


def valid_id(value: str) -> bool:
    return bool(ID_PATTERN.match(value)) and ".." not in value


def _detail(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text.strip() or response.reason_phrase
    if isinstance(body, dict):
        detail = body.get("detail", body)
        if isinstance(detail, list):
            # FastAPI validation errors arrive as a list of objects.
            return "; ".join(str(item.get("msg", item)) for item in detail)
        return str(detail)
    return str(body)


class JobApiClient:
    def __init__(self, base_url: str, transport: httpx.AsyncBaseTransport | None = None,
                 timeout: float = 10.0):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, transport=transport,
                                         timeout=timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.TransportError as exc:
            raise ApiUnavailable(f"Could not reach the job API at {self.base_url}: {exc}") from exc
        if response.status_code >= 400:
            raise ApiError(response.status_code, _detail(response))
        return response

    async def list_jobs(self) -> list[dict[str, Any]]:
        body = (await self._request("GET", "/jobs")).json()
        jobs = body.get("jobs", []) if isinstance(body, dict) else body
        return [job for job in jobs if isinstance(job, dict)]

    async def get_job(self, job_id: str) -> dict[str, Any]:
        _require_id(job_id)
        body = (await self._request("GET", f"/jobs/{job_id}")).json()
        if not isinstance(body, dict):
            raise ApiError(502, "The job API returned an unexpected job shape.")
        return body

    async def review(self, job_id: str, decision: str, notes: str,
                     rubric: dict[str, int]) -> dict[str, Any]:
        _require_id(job_id)
        if decision not in REVIEW_DECISIONS:
            raise ValueError(f"Unknown review decision: {decision}")
        payload = {"decision": decision, "notes": notes, "rubric": rubric}
        response = await self._request("POST", f"/jobs/{job_id}/review", json=payload)
        return _json_or_empty(response)

    async def cancel(self, job_id: str) -> dict[str, Any]:
        _require_id(job_id)
        return _json_or_empty(await self._request("POST", f"/jobs/{job_id}/cancel"))

    async def resume(self, job_id: str) -> dict[str, Any]:
        _require_id(job_id)
        return _json_or_empty(await self._request("POST", f"/jobs/{job_id}/resume"))

    async def open_artifact(self, job_id: str, artifact_id: str,
                            range_header: str | None) -> httpx.Response:
        """Start streaming an artifact. The caller must close the response."""
        _require_id(job_id)
        _require_id(artifact_id)
        headers = {"Range": range_header} if range_header else {}
        request = self._client.build_request(
            "GET", f"/jobs/{job_id}/artifacts/{artifact_id}", headers=headers)
        try:
            response = await self._client.send(request, stream=True)
        except httpx.TransportError as exc:
            raise ApiUnavailable(f"Could not reach the job API at {self.base_url}: {exc}") from exc
        if response.status_code >= 400:
            await response.aread()
            await response.aclose()
            raise ApiError(response.status_code, _detail(response))
        return response


async def iter_and_close(response: httpx.Response) -> AsyncIterator[bytes]:
    try:
        async for chunk in response.aiter_raw():
            yield chunk
    finally:
        await response.aclose()


def _require_id(value: str) -> None:
    if not valid_id(value):
        raise ApiError(404, "Unknown identifier.")


def _json_or_empty(response: httpx.Response) -> dict[str, Any]:
    if not response.content:
        return {}
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}
