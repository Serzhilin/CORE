import { EntitySubscriberInterface, EventSubscriber } from "typeorm";

@EventSubscriber()
export class CoreSubscriber implements EntitySubscriberInterface {
    // Phase 2: wire eVault sync here.
    // Community → GroupManifest schema a8bfb7cf-3200-4b25-9ea9-ee41100f212e
    // Person → User profile schema 550e8400-e29b-41d4-a716-446655440000
}
