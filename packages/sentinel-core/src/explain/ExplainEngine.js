export class ExplainEngine {
  run(understood) {
    return {
      ...understood,
      stage: "explain",
      explanation: `Sentinel identificó una publicación del actor ${understood.actor} en ${understood.source}.`
    };
  }
}