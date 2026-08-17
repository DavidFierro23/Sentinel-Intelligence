import { ObserveEngine } from "./observe/ObserveEngine.js";
import { UnderstandEngine } from "./understand/UnderstandEngine.js";
import { ExplainEngine } from "./explain/ExplainEngine.js";

const observe = new ObserveEngine();
const understand = new UnderstandEngine();
const explain = new ExplainEngine();

export const SentinelCore = {
  run(input) {
    const observed = observe.run(input);
    const understood = understand.run(observed);
    const explained = explain.run(understood);

    return explained;
  }
};

// Primera ejecución de prueba
const resultado = SentinelCore.run({
  actor: "Juan Cristóbal Jorel",
  source: "Facebook",
  content: "Nueva publicación sobre vialidad."
});

console.log("===== SENTINEL CORE v0.2 =====");
console.log(resultado);