
const Dashboard = () => {

  return (
    <div className="flex flex-col min-h-screen p-4 bg-neutral-900 text-neutral-50">
      <h1 className="text-3xl font-bold mb-6">Dashboard Home</h1>

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-neutral-800 rounded shadow">
          <p className="text-lg">Coffees Sold</p>
          <p className="text-2xl font-bold">123 465</p>
        </div>
        <div className="p-4 bg-neutral-800 rounded shadow">
          <p className="text-lg">April Total</p>
          <p className="text-2xl font-bold">R 13,450</p>
        </div>
        <div className="p-4 bg-neutral-800 rounded shadow">
          <p className="text-lg">Total Crew</p>
          <p className="text-2xl font-bold">5</p>
        </div>
        <div className="p-4 bg-neutral-800 rounded shadow">
          <p className="text-lg">Total Stores</p>
          <p className="text-2xl font-bold">5</p>
        </div>
        <div className="p-4 bg-neutral-800 rounded shadow">
          <p className="text-lg">Stock Running Low</p>
          <ul className="list-disc pl-5">
            <li>Waters</li>
            <li> Tinkies </li>
            <li> Coca Cola </li>
          </ul> 
        </div>
      </div>
      <p>Under Development... ( sample data above ) </p>
    </div>
  )
}

export default Dashboard