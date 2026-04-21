import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("availability_types")
export class AvailabilityType {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    community_id: string;

    @Column()
    name: string;

    @Column()
    emoji: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    @Column({ default: false })
    is_archived: boolean;

    @CreateDateColumn()
    created_at: Date;
}
