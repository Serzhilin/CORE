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

    @Column({ type: "varchar", nullable: true })
    website: string | null;

    @Column({ type: "varchar", nullable: true })
    location: string | null;

    @Column({ type: "varchar", nullable: true })
    birth_date: string | null;

    @Column({ type: "text", nullable: true })
    bio: string | null;

    @Column({ type: "text", nullable: true })
    avatar_url: string | null;

    @Column({ type: "varchar", nullable: true })
    display_name: string | null;

    @Column({ type: "text", nullable: true })
    banner_url: string | null;

    // MetaEnvelope ID of this person's W3DS User profile envelope.
    // participantIds/admins in Chat envelopes reference this ID, not ename — cache it once resolved.
    @Column({ type: "varchar", nullable: true })
    meta_envelope_id: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
