import Company from '../models/Company.js';

export const registerCompany = async (req, res) => {
  try {
    const companyData = { ...req.body, addedBy: req.user._id };
    const company = await Company.create(companyData);
    res.status(201).json(company);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({}).sort({ createdAt: -1 }).populate('addedBy', 'email');
    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: Could not fetch companies' });
  }
};

// @desc    Update a company (used for allotting or canceling slots)
// @route   PUT /api/companies/:id
// @access  Private/Admin
export const updateCompany = async (req, res) => {
  try {
    // Use explicit $set so that null values are written correctly,
    // allowing schedule.date and schedule.slot to be cleared (cancelled).
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: 'after', runValidators: false } // <-- FIXED THIS LINE
    );

    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.status(200).json(company);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};