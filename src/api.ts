import axios from "axios";

export class RadiacodeApi {
  private clientAddress?: string;

  constructor(radiacodeServer?: string) {
    if (radiacodeServer == null) {
      return;
    }
    this.clientAddress = radiacodeServer
  }

  public async getLatestSamples() {
    if (this.clientAddress == null) {
      throw new Error("Radiacode API Client not initialized due to invalid configuration...");
    }

    const response = await axios.get<RadiacodeApiDeviceSample>(this.clientAddress + '/doserate');
    return response.data;
  }
}

export interface RadiacodeApiDeviceSample {
  data: {
    doseRate?: number;
    timestamp?: number;
  }
}
