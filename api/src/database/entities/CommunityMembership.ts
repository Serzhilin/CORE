import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from "typeorm";

@Entity("community_memberships")
@Unique(["person_id", "community_id"])
export class CommunityMembership {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    person_id: string;

    @Column({ type: "uuid" })
    community_id: string;

    @Column({ default: false })
    is_admin: boolean;

    @Column({ type: "uuid", nullable: true })
    membership_type_id: string | null;

    @Column({ type: "date", nullable: true })
    joined_at: Date | null;

    @Column({ type: "uuid", nullable: true })
    availability_type_id: string | null;

    @Column({ type: "text", nullable: true })
    availability_reason: string | null;

    @Column({ type: "date", nullable: true })
    availability_from: Date | null;

    @Column({ type: "date", nullable: true })
    availability_until: Date | null;

    // MetaEnvelope ID of the member's User profile, cached once resolved — feeds the
    // Organization envelope's members[].participantId on every sync.
    @Column({ type: "varchar", nullable: true })
    meta_envelope_id: string | null;

    // Real eVault envelope id of this membership's Membership envelope, written to the
    // MEMBER's own vault (not the community's) — distinct from meta_envelope_id above.
    // Null until the community is linked AND the member has an ename (see MembershipEnvelopeService).
    @Column({ type: "text", nullable: true })
    membership_envelope_id: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
