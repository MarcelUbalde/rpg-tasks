// server/infrastructure/repositories/rewardHistoryRepository.js

import { db } from "../db.js";
import { makeRewardHistoryRepository } from "./rewardHistoryRepository.factory.js";

export const rewardHistoryRepository = makeRewardHistoryRepository(db);
