import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity("workgroup_memberships")
@Unique(["person_id", "workgroup_id"])
export class WorkgroupMembership {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    person_id: string;

    @Column({ type: "uuid" })
    workgroup_id: string;

    @Column({ default: false })
    is_workgroup_admin: boolean;

    @CreateDateColumn()
    created_at: Date;
}
