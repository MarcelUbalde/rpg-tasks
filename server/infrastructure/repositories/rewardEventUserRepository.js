// server/infrastructure/repositories/rewardEventUserRepository.js

import { db } from "../db.js";
import { makeRewardEventUserRepository } from "./rewardEventUserRepository.factory.js";

export const rewardEventUserRepository = makeRewardEventUserRepository(db);
