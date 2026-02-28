// server/infrastructure/repositories/userRepository.js

import { makeUserRepositoryPg } from "./userRepository.pg.factory.js";

export const userRepository = makeUserRepositoryPg();
