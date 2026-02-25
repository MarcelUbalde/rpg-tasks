// server/infrastructure/repositories/rewardEventRepository.js

import { db } from "../db.js";
import { makeRewardEventRepository } from "./rewardEventRepository.factory.js";

export const rewardEventRepository = makeRewardEventRepository(db);
