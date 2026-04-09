import Holiday from '../models/Holiday.js';

export const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find({});
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const declareHoliday = async (req, res) => {
  try {
    // Upsert: Creates it if it doesn't exist, updates if it does
    const holiday = await Holiday.findOneAndUpdate(
      { date: req.body.date }, 
      { name: req.body.name }, 
      { upsert: true, returnDocument: 'after' }
    );
    res.status(200).json(holiday);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// This handles your "Reverse Holiday" requirement!
export const removeHoliday = async (req, res) => {
  try {
    await Holiday.findOneAndDelete({ date: req.params.date });
    res.status(200).json({ message: 'Holiday reversed/removed' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};