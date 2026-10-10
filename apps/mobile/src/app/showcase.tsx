import { useState } from 'react';
import { View } from 'react-native';

import { PageHeader } from '../components/layout/PageHeader';
import { Screen } from '../components/layout/Screen';
import {
  AppText,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Input,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  Textarea,
} from '../components/ui';
import { colors } from '../theme/colors';

const palette = [
  ['背景', colors.background],
  ['卡片', colors.surface1],
  ['二级容器', colors.surface2],
  ['主色', colors.brand],
  ['成功', colors.positive],
  ['警告', colors.warning],
] as const;

export default function ShowcaseScreen() {
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [tab, setTab] = useState('one');
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
    <Screen scroll>
      <View className="px-screen pt-4">
        <PageHeader title="UI Showcase" subtitle="仅供开发检查，不属于正式底部导航。" />

        <Section title="字体层级">
          <AppText variant="display">Display 32</AppText>
          <AppText variant="title" className="mt-2">
            Title 24
          </AppText>
          <AppText variant="section" className="mt-2">
            Section 20
          </AppText>
          <AppText variant="body" className="mt-2">
            Body 16 · 统一中文正文层级
          </AppText>
          <AppText variant="caption" muted className="mt-2">
            Caption 13 · 辅助说明文字
          </AppText>
        </Section>

        <Section title="主题颜色">
          <View className="flex-row flex-wrap gap-3">
            {palette.map(([label, color]) => (
              <View className="w-[29%]" key={label}>
                <View className="h-12 rounded-lg border border-border" style={{ backgroundColor: color }} />
                <AppText variant="label" muted className="mt-2">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="按钮">
          <View className="gap-3">
            <Button size="sm">小号主按钮</Button>
            <Button>主按钮</Button>
            <Button size="lg" variant="secondary">
              次级按钮
            </Button>
            <Button variant="ghost">文字按钮</Button>
            <Button variant="danger">危险按钮</Button>
            <Button loading>加载中</Button>
            <Button disabled variant="secondary">
              禁用按钮
            </Button>
          </View>
        </Section>

        <Section title="表单控件">
          <View className="gap-3">
            <Input placeholder="请输入内容" />
            <Textarea placeholder="请输入多行内容" />
            <View className="flex-row items-center gap-3">
              <Checkbox checked={checked} onCheckedChange={setChecked} />
              <AppText>Checkbox {checked ? '已选中' : '未选中'}</AppText>
            </View>
            <View className="flex-row items-center justify-between">
              <AppText>Switch {enabled ? '开启' : '关闭'}</AppText>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
          </View>
        </Section>

        <Section title="容器与状态">
          <Card>
            <AppText variant="card">Surface Card</AppText>
            <AppText className="mt-2 text-secondary">卡片复用统一表面、边框和圆角。</AppText>
            <Separator className="my-4" />
            <View className="flex-row flex-wrap gap-2">
              <Badge variant="brand">品牌</Badge>
              <Badge variant="positive">成功</Badge>
              <Badge variant="warning">警告</Badge>
              <Badge>中性</Badge>
            </View>
          </Card>
          <View className="mt-4 flex-row items-center gap-4">
            <Spinner />
            <Spinner size="large" />
            <Skeleton className="h-10 flex-1" />
          </View>
        </Section>

        <Section title="Tabs 与 Dialog">
          <Tabs
            options={[
              { key: 'one', label: '选项一' },
              { key: 'two', label: '选项二' },
              { key: 'three', label: '选项三' },
            ]}
            value={tab}
            onValueChange={setTab}
          />
          <Button className="mt-4" onPress={() => setDialogVisible(true)} variant="secondary">
            打开 Dialog
          </Button>
          <Dialog
            description="这是通用 Dialog 的基础展示状态。"
            onClose={() => setDialogVisible(false)}
            title="确认操作"
            visible={dialogVisible}
          />
        </Section>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8">
      <AppText variant="section" className="mb-3">
        {title}
      </AppText>
      {children}
    </View>
  );
}
