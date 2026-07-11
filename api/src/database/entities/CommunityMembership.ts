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

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
