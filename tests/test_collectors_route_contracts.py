import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.dependencies import get_collector_service
from server.routes.collectors import router


class FakeCollectorService:
    def __init__(self):
        self.source_tools = {}
        self.status_map = {}
        self.tools_by_target = {}
        self.next_run_result = None
        self.next_toggle_result = None

        self.last_run_call = None
        self.last_background_call = None
        self.last_run_all_call = None
        self.last_toggle_call = None
        self.last_get_tools_arg = None
        self.last_source_tools_arg = None

    def get_all_statuses(self):
        return [{"source": "github", "status": "active"}]

    def get_tool_manager_status(self):
        return {
            "initialized": True,
            "health_report": {"total_tools": 2},
            "registered_executors": ["gitleaks", "trufflehog"],
            "circuit_breakers_open": [],
            "effectiveness_matrix": {},
            "effectiveness_config": {},
            "technology_signatures": {},
        }

    def get_tool_targets(self):
        return [{"target_type": "github_intel", "total_tools": 2, "available_tools": 2, "best_tool": "gitleaks"}]

    def get_source_tools(self, source):
        self.last_source_tools_arg = source
        return self.source_tools.get(source, [])

    def get_tools(self, target_type=None):
        self.last_get_tools_arg = target_type
        if target_type:
            return self.tools_by_target.get(target_type, [])
        return [{"name": "gitleaks"}, {"name": "trufflehog"}]

    def get_status(self, source):
        return self.status_map.get(source)

    def run_collector(
        self,
        source,
        query=None,
        max_results=50,
        preferred_tool=None,
        use_tool_registry=True,
        scan_signatures=True,
    ):
        self.last_run_call = {
            "source": source,
            "query": query,
            "max_results": max_results,
            "preferred_tool": preferred_tool,
            "use_tool_registry": use_tool_registry,
            "scan_signatures": scan_signatures,
        }
        if self.next_run_result is not None:
            return self.next_run_result
        return {
            "source": source,
            "query": query or "",
            "collected": 1,
            "inserted": 1,
            "duplicates": 0,
            "errors": [],
            "elapsed": 0.01,
            "tool_name": preferred_tool or "gitleaks",
            "tools_tried": [preferred_tool or "gitleaks"],
            "fallback_used": False,
            "warnings": [],
        }

    def run_collector_background(
        self,
        source,
        query=None,
        max_results=50,
        preferred_tool=None,
        use_tool_registry=True,
        scan_signatures=True,
    ):
        self.last_background_call = {
            "source": source,
            "query": query,
            "max_results": max_results,
            "preferred_tool": preferred_tool,
            "use_tool_registry": use_tool_registry,
            "scan_signatures": scan_signatures,
        }
        return {"message": f"Collector {source} started in background"}

    def run_all_background(self, max_results=50, use_tool_registry=True, scan_signatures=True):
        self.last_run_all_call = {
            "max_results": max_results,
            "use_tool_registry": use_tool_registry,
            "scan_signatures": scan_signatures,
        }
        return {"message": "Started 1 collectors", "sources": ["github"]}

    def toggle_collector(self, source, enabled):
        self.last_toggle_call = {"source": source, "enabled": enabled}
        return self.next_toggle_result


def make_client(service: FakeCollectorService) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_collector_service] = lambda: service
    return TestClient(app)


class CollectorRouteContractTests(unittest.TestCase):
    def setUp(self):
        self.service = FakeCollectorService()
        self.client = make_client(self.service)

    def test_run_collector_applies_request_defaults(self):
        response = self.client.post("/api/collectors/github/run", json={"query": "api_key"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.service.last_run_call["query"], "api_key")
        self.assertEqual(self.service.last_run_call["max_results"], 50)
        self.assertIsNone(self.service.last_run_call["preferred_tool"])
        self.assertTrue(self.service.last_run_call["use_tool_registry"])
        self.assertTrue(self.service.last_run_call["scan_signatures"])

    def test_run_collector_rejects_invalid_max_results(self):
        response = self.client.post(
            "/api/collectors/github/run",
            json={"query": "x", "max_results": 501},
        )

        self.assertEqual(response.status_code, 422)

    def test_run_collector_background_forwards_schema_fields(self):
        response = self.client.post(
            "/api/collectors/github/run?background=true",
            json={
                "query": "secret",
                "max_results": 25,
                "preferred_tool": "trufflehog",
                "use_tool_registry": False,
                "scan_signatures": False,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(self.service.last_background_call["query"], "secret")
        self.assertEqual(self.service.last_background_call["max_results"], 25)
        self.assertEqual(self.service.last_background_call["preferred_tool"], "trufflehog")
        self.assertFalse(self.service.last_background_call["use_tool_registry"])
        self.assertFalse(self.service.last_background_call["scan_signatures"])

    def test_run_collector_maps_service_error_to_400(self):
        self.service.next_run_result = {"error": "forced failure"}

        response = self.client.post("/api/collectors/github/run", json={"query": "x"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "forced failure")

    def test_get_collector_returns_404_for_unknown_source(self):
        response = self.client.get("/api/collectors/unknown")

        self.assertEqual(response.status_code, 404)
        self.assertIn("Collector 'unknown' not found", response.json()["detail"])

    def test_list_tools_with_source_returns_404_when_source_missing(self):
        response = self.client.get("/api/collectors/tools?source=ghost")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.service.last_source_tools_arg, "ghost")

    def test_list_tools_with_target_type_forwards_query_param(self):
        self.service.tools_by_target["github_intel"] = [{"name": "gitleaks"}]

        response = self.client.get("/api/collectors/tools?target_type=github_intel")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.service.last_get_tools_arg, "github_intel")
        self.assertEqual(response.json(), [{"name": "gitleaks"}])

    def test_run_all_background_contract(self):
        response = self.client.post(
            "/api/collectors/run-all?max_results=20&use_tool_registry=false&scan_signatures=false"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(self.service.last_run_all_call["max_results"], 20)
        self.assertFalse(self.service.last_run_all_call["use_tool_registry"])
        self.assertFalse(self.service.last_run_all_call["scan_signatures"])

    def test_toggle_collector_returns_404_when_service_returns_none(self):
        self.service.next_toggle_result = None

        response = self.client.patch("/api/collectors/github/toggle?enabled=false")

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
