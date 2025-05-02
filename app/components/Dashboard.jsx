import Products from "../components/Products";
import OrderCheckout from "../components/OrderCheckout";
import Sidebar from "../components/Sidebar";


export default function Dashboard() { 
  return ( 
    <div className="flex min-h-screen bg-neutral-900 text-neutral-50"> 

      <div className="w-3/4 flex">
        {/* Menu Button */} 
        <Sidebar /> 
        <Products />  
      </div> 

      <OrderCheckout />       

    </div> 
  );
}