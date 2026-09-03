import { executarSuiteDeContrato } from "./__tests__/contract";
import { criarAdaptadorMemoria } from "./memory";

executarSuiteDeContrato("adaptador em memória", criarAdaptadorMemoria);
