export class UnderstandEngine {
  run(observed) {
    return {
      ...observed,
      stage: "understand",
      context: `El contenido pertenece al actor ${observed.actor}.`
    };
  }
}