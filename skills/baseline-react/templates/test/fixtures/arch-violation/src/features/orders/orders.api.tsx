// Deliberate violation (REACT-ARCH-11): the published API pulls the page into every consumer
import { OrdersPage } from './adapter/in/ui/orders-page';

export const OrdersApiProvider = OrdersPage;
