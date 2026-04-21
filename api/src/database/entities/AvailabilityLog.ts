import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("availability_logs")
export class AvailabilityLog {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Index()
    @Column({ type: "uuid" })
    community_membership_id: string;

    @Column()
    type_name: string;

    @Column()
    type_emoji: string;

    @Column({ type: "text", nullable: true })
    reason: string | null;

    @Column({ type: "date" })
    from_date: Date;

    @Column({ type: "date" })
    until_date: Date;

    @CreateDateColumn()
    created_at: Date;
}
