import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("organization_membership_types")
export class OrganizationMembershipType {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ type: "text", nullable: true })
    emoji: string | null;

    @Column({ default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
