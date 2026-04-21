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

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
