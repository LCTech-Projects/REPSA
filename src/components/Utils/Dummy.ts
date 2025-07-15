export const pvArgs={
    lat: 34.125,
    lon: 39.814,
    date_from: '2015-01-01',
    date_to: '2015-12-31',
    dataset: 'merra2',
    capacity: 1.0,
    system_loss: 0.1,
    tracking: 0,
    tilt: 35,
    azim: 180,
    format: 'json'
}

export const windArgs={
    lat: 34.125,
    lon: 39.814,
    date_from: '2015-01-01',
    date_to: '2015-12-31',
    capacity: 1.0,
    height: 100,
    turbine: 'Vestas V80 2000',
    format: 'json'
}

export const electricityDemandArgs={
    entity: "South Africa",
    start_date: "2000",
    end_date: '2025',
}

export const populationArgs={
    country_code: "ZA",
    date: "2000:2025",
    format: 'json',
}

export const energyUseArgs={
    country_code: "CN",
    format: 'json',
}