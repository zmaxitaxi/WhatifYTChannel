"""Semantic validation precedes all renderer work; unsupported capabilities are explicit."""

from dataclasses import dataclass

from aether.contracts import OPERATIONS, ProductionSpec


@dataclass
class CapabilityError(ValueError):
    missing: list[str]

    def __str__(self) -> str:
        return "Needs development: " + ", ".join(self.missing)


def validate_capabilities(spec: ProductionSpec) -> None:
    missing = []
    if spec.scenario_family != "relocation":
        missing.append(f"scenario:{spec.scenario_family}")
    for shot in spec.shots:
        if shot.operation not in OPERATIONS:
            missing.append(f"operation:{shot.operation}")
    if missing:
        raise CapabilityError(sorted(set(missing)))


def load_spec(raw: str) -> ProductionSpec:
    spec = ProductionSpec.model_validate_json(raw)
    validate_capabilities(spec)
    return spec
