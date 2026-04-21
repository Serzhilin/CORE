import { EntitySubscriberInterface, EventSubscriber } from "typeorm";

@EventSubscriber()
export class CoreSubscriber implements EntitySubscriberInterface {
    // Phase 2: eVault sync will be wired here
}
