import OrderCheckout from "../../components/OrderCheckout";
import Products from "../../components/Products";


const Sales = () => {

    return (
      <div className="flex bg-neutral-900 text-neutral-50"> 

        <div className="w-3/4 flex pt-4 pl-4 max-h-screen overflow-auto"> 
          <Products />
        </div> 

        <OrderCheckout />       

      </div>
    )
  }
  
  export default Sales