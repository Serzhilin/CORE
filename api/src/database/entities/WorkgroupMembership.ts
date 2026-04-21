import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity("workgroup_memberships")
@Unique(["person_id", "workgroup_id"])
export class WorkgroupMembership {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    person_id: string;

    @Column()
    workgroup_id: string;

    @Column({ default: false })
    is_workgroup_admin: boolean;

    @CreateDateColumn()
    created_at: Date;
}
