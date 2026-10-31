import copy
import json
from pathlib import Path

from aether.contracts import ProductionSpec


def export_schema(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    schema = ProductionSpec.model_json_schema(mode="serialization")
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    destination.write_text(json.dumps(schema, indent=2) + "\n")


def structured_output_schema() -> dict:
    """Codex structured outputs require explicitly required fields, including nullable ones."""
    schema = copy.deepcopy(ProductionSpec.model_json_schema())

    def visit(node):
        if isinstance(node, dict):
            node.pop("default", None)
            if node.get("type") == "object" and "properties" in node:
                node["required"] = list(node["properties"])
                node["additionalProperties"] = False
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(schema)
    return schema
