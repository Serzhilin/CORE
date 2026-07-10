import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("communities")
export class Community {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ type: "text", nullable: true })
    logo_url: string | null;

    @Column({ default: "#C4622D" })
    primary_color: string;

    @Column({ default: "Playfair Display" })
    title_font: string;

    @Column({ type: "varchar", nullable: true })
    ename: string | null;

    @Column({ type: "text", nullable: true })
    evault_uri: string | null;

    // MetaEnvelope ID of this community's Chat envelope (group identity), set on link.
    @Column({ type: "text", nullable: true })
    community_envelope_id: string | null;

    // 'unlinked' (local only, no eVault) | 'linked' (attached to an existing W3DS eName)
    @Column({ default: "unlinked" })
    provisioning_status: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
