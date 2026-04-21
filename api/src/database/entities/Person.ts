import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("persons")
export class Person {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", nullable: true, unique: true })
    ename: string | null;

    @Column({ type: "varchar", nullable: true })
    first_name: string | null;

    @Column({ type: "varchar", nullable: true })
    last_name: string | null;

    @Column({ type: "varchar", nullable: true })
    email: string | null;

    @Column({ type: "varchar", nullable: true })
    phone: string | null;

    @Column({ type: "text", nullable: true })
    bio: string | null;

    @Column({ type: "text", nullable: true })
    avatar_url: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
