function PersonAddForm({ newFirstName, setNewFirstName, newLastName, setNewLastName, onAddPerson }) {
  return (
    <div className="card p-5 sticky top-4">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Snabbregistrering</h2>
      <form onSubmit={onAddPerson} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Förnamn</label>
          <input
            type="text"
            placeholder="T.ex. Anna MARIA"
            required
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-200 outline-none" />
          <p className="text-xs text-gray-400 mt-1">Tips: Skriv tilltalsnamn med STORA bokstäver.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Efternamn</label>
          <input
            type="text"
            placeholder="T.ex. Andersson"
            required
            value={newLastName}
            onChange={(e) => setNewLastName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-200 outline-none" />
        </div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm">
          Skapa Person
        </button>
      </form>
    </div>
  );
}

export default PersonAddForm;