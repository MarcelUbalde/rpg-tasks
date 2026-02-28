// server/infrastructure/repositories/rewardHistoryRepository.js

import { makeRewardHistoryRepositoryPg } from "./rewardHistoryRepository.pg.factory.js";

export const rewardHistoryRepository = makeRewardHistoryRepositoryPg();
