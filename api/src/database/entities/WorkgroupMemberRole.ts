import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity("workgroup_member_roles")
@Unique(["workgroup_membership_id", "role_id"])
export class WorkgroupMemberRole {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    workgroup_membership_id: string;

    @Column()
    role_id: string;

    @CreateDateColumn()
    created_at: Date;
}
