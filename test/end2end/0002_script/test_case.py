import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    def test_manual_init(self):
        # inserted before init; processed by html2pdf4doc:
        before = '//html2pdf4doc-content-flow/*[@id="before-init"]'
        # inserted after init; stays in <body> (not processed):
        after = '//body/*[@id="after-init"]'
        self.helper.open_case(path_to_this_test_file_folder, 'manual-init')
        self.helper.wait_for(before)
        self.helper.wait_for(after)
        self.helper.assert_html2pdf4doc_success()

    def test_dynamic_script(self):
        self.helper.open_case(path_to_this_test_file_folder, 'dynamic-script')
        self.helper.assert_html2pdf4doc_elements()
        self.helper.assert_html2pdf4doc_success()

    def test_module(self):
        self.helper.open_case(path_to_this_test_file_folder, 'module')
        self.helper.assert_text('Hello world!')
        self.helper.assert_no_html2pdf4doc_elements()

    def test_render_ready_programmatic_option(self):
        async_rendered = '//html2pdf4doc-content-flow//*[@id="async-rendered"]'
        self.helper.open_case(path_to_this_test_file_folder, 'render-ready')
        self.helper.wait_for(async_rendered)
        self.helper.assert_html2pdf4doc_success()
