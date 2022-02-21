import { RadiacodeApi, RadiacodeApiDeviceInfo, RadiacodeApiDeviceSample } from "./api";
import { Mutex } from "async-mutex";
import { AccessoryConfig, AccessoryPlugin, API, Logging, Service } from "homebridge";

export = (api: API) => {
  api.registerAccessory("Radiacode", RadiacodePlugin);
};

class RadiacodePlugin implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly mutex: Mutex;

  private readonly radiacodeApi: RadiacodeApi;
  private readonly radiacodeConfig: RadiacodePluginConfig;

  private readonly informationService: Service;
  private readonly airQualityService: Service;
  private readonly doseRateService: Service;

  private latestSamples: RadiacodeApiDeviceSample = {
    data: {}
  };
  private deviceInfo: RadiacodeApiDeviceInfo = {
    data: {}
  }
  private latestSamplesTimestamp: number = 0;

  constructor(log: Logging, config: RadiacodePluginConfig, api: API) {
    if (config.radiacodeServer == null) {
      log.error("Missing required config value: radiacodeServer");
    }

    this.log = log;
    this.mutex = new Mutex();

    this.radiacodeApi = new RadiacodeApi(config.radiacodeServer);
    this.radiacodeConfig = config;

    // HomeKit Information Service
    this.informationService = new api.hap.Service.AccessoryInformation()
      .setCharacteristic(api.hap.Characteristic.Manufacturer, "Radiascan")
      .setCharacteristic(api.hap.Characteristic.Model, "Radiacode 101")
      .setCharacteristic(api.hap.Characteristic.Name, config.name);
    this.informationService.getCharacteristic(api.hap.Characteristic.SerialNumber).onGet(async () => {
      await this.getHWInfo();
      return this.deviceInfo.data['serial'] ?? "Unknown"
    })
    this.informationService.getCharacteristic(api.hap.Characteristic.FirmwareRevision).onGet(async () => {
      //await this.getHWInfo();
      return /*this.deviceInfo.data['fw_version'] ?? */"Unknown"
    })
    // HomeKit Air Quality Service
    this.airQualityService = new api.hap.Service.AirQualitySensor("Radiation Levels");

    this.doseRateService = new api.hap.Service.OccupancySensor("Dose Rate");



    this.airQualityService.getCharacteristic(api.hap.Characteristic.AirQuality)
      .onGet(async () => {
        await this.getLatestSamples();

        let aq = api.hap.Characteristic.AirQuality.UNKNOWN;

        const doserate = this.latestSamples.data['doserate'];
        if (typeof doserate !== 'undefined') {
          if (doserate >= 0.3) {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.POOR);
          }
          else if (doserate >= 0.2) {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.INFERIOR);
          }
          else if (doserate >= 0.15) {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.FAIR);
          }
          else if (doserate >= 0.1) {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.GOOD);
          }
          else {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.EXCELLENT);
          }
        } else {
          this.log.warn("doserate undefined?")
        }

        return aq;
      });
    const occupancyCharacteristic = new api.hap.Characteristic('OccupancyDetected', '00000071-0000-1000-8000-0026BB765291', {
      format: api.hap.Formats.UINT8,
      perms: [api.hap.Perms.NOTIFY, api.hap.Perms.PAIRED_READ],
      minValue: 0,
      maxValue: 1,
    }).onGet(async () => {
      await this.getLatestSamples();
      if (this.latestSamples.data['doserate'] && this.latestSamples.data['doserate'] >= 0.2) {
        return 1
      } else {
        return 0;
      }
    });
    const doserateCharacteristic = new api.hap.Characteristic('Name', '00000023-0000-1000-8000-0026BB765291', {
      format: api.hap.Formats.STRING,
      perms: [api.hap.Perms.PAIRED_READ],
    }).onGet(async () => {
      await this.getLatestSamples();
      if (this.latestSamples.data['doserate']) {
        return this.latestSamples.data['doserate'].toPrecision(3).toString() + " uSv/hr"
      } else {
        return "Unknown";
      }
    });
    this.doseRateService.addCharacteristic(occupancyCharacteristic);
    this.doseRateService.addCharacteristic(doserateCharacteristic);

    this.airQualityService.getCharacteristic(api.hap.Characteristic.StatusActive)
      .onGet(async () => {
        await this.getLatestSamples();
        return this.latestSamples.data.timestamp != null && Date.now() / 1000 - this.latestSamples.data.timestamp < 2 * 60 * 60;
      });
  }

  getServices(): Service[] {
    const services = [this.informationService, this.airQualityService];
    return services;
  }

  async getHWInfo() {
    try {
      this.deviceInfo = await this.radiacodeApi.getHWInfo() ?? {data:{}}
      this.log.info(JSON.stringify(this.deviceInfo.data));
    }
    catch (err) {
      if (err instanceof Error) {
        this.log.error(err.message);
      }
    }
  }

  async getLatestSamples() {
    await this.mutex.runExclusive(async () => {
      if (Date.now() - this.latestSamplesTimestamp > 5 * 1000) {
        this.log.info(`Refreshing latest samples...`)

        try {
          this.latestSamples = await this.radiacodeApi.getLatestSamples() ?? {data:{}};
          this.latestSamplesTimestamp = Date.now();
          this.log.info(JSON.stringify(this.latestSamples.data));
        }
        catch (err) {
          if (err instanceof Error) {
            this.log.error(err.message);
          }
        }
      }
    });
  }
}

interface RadiacodePluginConfig extends AccessoryConfig {
  radiacodeServer?: string;
}
