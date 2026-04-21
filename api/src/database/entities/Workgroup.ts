import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("workgroups")
export class Workgroup {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ default: "#C4622D" })
    color: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
