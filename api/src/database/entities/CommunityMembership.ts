import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from "typeorm";

@Entity("community_memberships")
@Unique(["person_id", "community_id"])
export class CommunityMembership {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    person_id: string;

    @Column()
    community_id: string;

    @Column({ default: false })
    is_admin: boolean;

    @Column({ default: false })
    is_aspirant: boolean;

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

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
