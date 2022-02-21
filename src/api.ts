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

    const response = await axios.get<RadiacodeApiDeviceSample>(this.clientAddress + '/doserate')
    .catch(function (error) {
      console.log(error.toJSON());
    });
    return response?.data;
  }
  public async getHWInfo() {
    if (this.clientAddress == null) {
      throw new Error("Radiacode API Client not initialized due to invalid configuration...");
    }

    const response = await axios.get<RadiacodeApiDeviceInfo>(this.clientAddress + '/info')
    .catch(function (error) {
      console.log(error.toJSON());
    });
    return response?.data;
  }
}

export interface RadiacodeApiDeviceSample {
  data: {
    doserate?: number;
    timestamp?: number;
  }
}

export interface RadiacodeApiDeviceInfo {
  data: {
    serial?: string;
    fw_version?: string;
    battery?: number;
  }
}