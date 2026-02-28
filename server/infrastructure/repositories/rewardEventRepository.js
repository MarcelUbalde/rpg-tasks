// server/infrastructure/repositories/rewardEventRepository.js

import { makeRewardEventRepositoryPg } from "./rewardEventRepository.pg.factory.js";

export const rewardEventRepository = makeRewardEventRepositoryPg();
