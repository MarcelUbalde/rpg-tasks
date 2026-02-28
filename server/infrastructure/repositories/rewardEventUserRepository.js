// server/infrastructure/repositories/rewardEventUserRepository.js

import { makeRewardEventUserRepositoryPg } from "./rewardEventUserRepository.pg.factory.js";

export const rewardEventUserRepository = makeRewardEventUserRepositoryPg();
