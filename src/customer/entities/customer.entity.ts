import { CustomerInterface } from "src/interfaces/customer.interface";
import { BaseEntity } from "../../entities/base.entity";
import { Column, Entity } from "typeorm";

@Entity('customer')
export class Customer extends BaseEntity implements CustomerInterface {
    
    @Column({type: 'uuid'})
    zone_id: string;

    @Column({type: 'varchar', length: 10})
    document_number: string;

    @Column({type: 'varchar', length: 100})
    name: string;

    @Column({type: 'varchar', length: 100})
    last_name: string;

    @Column({type: 'varchar', length: 100})
    address: string;

    @Column({type: 'varchar', length: 15})
    phone: string;

    @Column({type: 'varchar', length: 50})
    email: string;
}
