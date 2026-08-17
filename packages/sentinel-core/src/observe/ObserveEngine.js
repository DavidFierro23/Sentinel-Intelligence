export class ObserveEngine {
  run(input) {
    return {
      stage: "observe",
      actor: input.actor,
      source: input.source,
      content: input.content,
      timestamp: new Date().toISOString()
    };
  }
}