from utils.data_loader import DataStore



def hourly_data(country=None, year=None):
    data = DataStore.filter_hourly_elec_data(country=country, year=year)
    return data

def yearly_data(country=None, year=None):
    data = DataStore.filter_yearly_elec_data(country=country, year=year)
    return data

