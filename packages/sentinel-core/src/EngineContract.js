export class EngineContract {
  observe(input) {
    throw new Error("observe() debe implementarse.");
  }

  understand(input) {
    throw new Error("understand() debe implementarse.");
  }

  explain(input) {
    throw new Error("explain() debe implementarse.");
  }
}