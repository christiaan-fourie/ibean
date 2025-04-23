import Products from "../components/Products";
import OrderCheckout from "../components/OrderCheckout";
import Header from "../components/Header";


export default function Dashboard() { 
  return ( 
    <div className="flex min-h-screen p-4 bg-neutral-900 text-neutral-50"> 

      <div className="w-3/4"> 
        {/* Menu Button */} 
        <Header /> 
        <Products />  
      </div> 

      <OrderCheckout />       

    </div> 
  );
}
