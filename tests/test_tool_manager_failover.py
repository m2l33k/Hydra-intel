import time
import unittest

from core.tool_manager import ToolManager
from core.tool_registry import TargetType, ToolDefinition, ToolStatus, ToolType


class FakeRegistry:
    def __init__(self, chain):
        self._chain = list(chain)
        self._by_name = {tool.name: tool for tool in self._chain}

    def get_tool(self, name):
        return self._by_name.get(name)

    def get_fallback_chain(self, target):
        return [tool for tool in self._chain if tool.target_type == target]

    def get_health_report(self):
        return {"total_tools": len(self._chain)}

    def get_effectiveness_matrix(self):
        return {}

    def get_effectiveness_config(self):
        return {}

    def get_technology_signatures(self):
        return {}


def make_tool(name: str) -> ToolDefinition:
    tool = ToolDefinition(
        name=name,
        target_type=TargetType.GITHUB_INTEL,
        tool_type=ToolType.REST_API,
        description=f"Test tool: {name}",
    )
    tool.status = ToolStatus.AVAILABLE
    return tool


class ToolManagerFailoverTests(unittest.TestCase):
    def test_selects_first_successful_tool(self):
        primary = make_tool("primary")
        secondary = make_tool("secondary")
        manager = ToolManager(registry=FakeRegistry([primary, secondary]))

        manager.executor_registry.register(
            "primary", lambda tool, query, max_results, **kw: [{"id": "ok"}]
        )
        manager.executor_registry.register(
            "secondary",
            lambda tool, query, max_results, **kw: self.fail("secondary should not execute"),
        )

        result = manager.run(TargetType.GITHUB_INTEL, query="token")

        self.assertTrue(result.success)
        self.assertEqual(result.tool_name, "primary")
        self.assertFalse(result.fallback_used)
        self.assertEqual(result.tools_tried, ["primary"])
        self.assertEqual(len(result.data), 1)
        self.assertEqual(primary.total_successes, 1)
        self.assertEqual(primary.consecutive_errors, 0)

    def test_failover_to_secondary_when_primary_raises(self):
        primary = make_tool("primary")
        secondary = make_tool("secondary")
        manager = ToolManager(registry=FakeRegistry([primary, secondary]))

        def _primary_fail(tool, query, max_results, **kw):
            raise RuntimeError("primary failed")

        manager.executor_registry.register("primary", _primary_fail)
        manager.executor_registry.register(
            "secondary", lambda tool, query, max_results, **kw: [{"id": "fallback"}]
        )

        result = manager.run(TargetType.GITHUB_INTEL, query="secret")

        self.assertTrue(result.success)
        self.assertEqual(result.tool_name, "secondary")
        self.assertTrue(result.fallback_used)
        self.assertEqual(result.tools_tried, ["primary", "secondary"])
        self.assertEqual(len(result.data), 1)
        self.assertEqual(primary.consecutive_errors, 1)
        self.assertEqual(primary.total_runs, 1)

    def test_failover_to_secondary_when_primary_returns_empty(self):
        primary = make_tool("primary")
        secondary = make_tool("secondary")
        manager = ToolManager(registry=FakeRegistry([primary, secondary]))

        manager.executor_registry.register("primary", lambda tool, query, max_results, **kw: [])
        manager.executor_registry.register(
            "secondary", lambda tool, query, max_results, **kw: [{"id": "fallback"}]
        )

        result = manager.run(TargetType.GITHUB_INTEL, query="key")

        self.assertTrue(result.success)
        self.assertEqual(result.tool_name, "secondary")
        self.assertTrue(result.fallback_used)
        self.assertEqual(result.tools_tried, ["primary", "secondary"])
        self.assertTrue(
            any("returned empty results" in warning for warning in result.warnings),
            msg=f"Expected empty-result warning in {result.warnings}",
        )

    def test_returns_error_when_preferred_tool_not_found(self):
        manager = ToolManager(registry=FakeRegistry([make_tool("primary")]))

        result = manager.run(
            TargetType.GITHUB_INTEL,
            query="x",
            preferred_tool="does-not-exist",
        )

        self.assertFalse(result.success)
        self.assertEqual(result.tool_name, "does-not-exist")
        self.assertIn("not found in registry", result.error or "")

    def test_skips_tool_when_circuit_breaker_is_open(self):
        primary = make_tool("primary")
        secondary = make_tool("secondary")
        manager = ToolManager(registry=FakeRegistry([primary, secondary]))

        calls = {"primary": 0}

        def _primary(tool, query, max_results, **kw):
            calls["primary"] += 1
            return [{"id": "should-not-run"}]

        manager.executor_registry.register("primary", _primary)
        manager.executor_registry.register(
            "secondary", lambda tool, query, max_results, **kw: [{"id": "secondary"}]
        )

        manager._circuit_open_since["primary"] = time.time()

        result = manager.run(TargetType.GITHUB_INTEL, query="z")

        self.assertTrue(result.success)
        self.assertEqual(result.tool_name, "secondary")
        self.assertEqual(calls["primary"], 0)
        self.assertEqual(result.tools_tried, ["primary", "secondary"])
        self.assertTrue(
            any("Circuit breaker open for 'primary'" in warning for warning in result.warnings),
            msg=f"Expected circuit-breaker warning in {result.warnings}",
        )


if __name__ == "__main__":
    unittest.main()
